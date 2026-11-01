import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchFleetTrackerLocations } from "./api";
import type { FleetTrackerProgress } from "./types";

function ndjsonStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function stubWindow(): void {
  vi.stubGlobal("window", { location: { origin: "https://miniapp.test" } });
}

describe("fetchFleetTrackerLocations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses chunked NDJSON progress and returns the final fleet locations", async () => {
    stubWindow();
    const located = [
      {
        id: "car-1",
        plate: "AA123",
        make: "Toyota",
        model: null,
        latitude: 52.1,
        longitude: 21.1,
        speed: 44,
        course: null,
        fixTime: "2026-11-01 12:00:00",
        online: true,
        status: "Moving",
        cached: false,
      },
    ];
    const missing = [
      {
        id: "car-2",
        plate: "BB456",
        make: null,
        model: "Leaf",
        error: "tracker_no_fix",
      },
    ];
    const payload = [
      {
        type: "start",
        total: 2,
        skipped: 0,
        cars: [
          { id: "car-1", plate: "AA123", make: "Toyota", model: null },
          { id: "car-2", plate: "BB456", make: null, model: "Leaf" },
        ],
      },
      {
        type: "progress",
        done: 1,
        total: 2,
        id: "car-1",
        plate: "AA123",
        make: "Toyota",
        model: null,
        status: "located",
      },
      {
        type: "progress",
        done: 2,
        total: 2,
        id: "car-2",
        plate: "BB456",
        make: null,
        model: "Leaf",
        status: "missing",
        error: "tracker_no_fix",
      },
      { type: "done", located, missing },
    ].map((event) => `${JSON.stringify(event)}\n`).join("");
    const fetchMock = vi.fn(async () =>
      new Response(ndjsonStream([payload.slice(0, 37), payload.slice(37, 145), payload.slice(145)])),
    );
    vi.stubGlobal("fetch", fetchMock);
    const progress: FleetTrackerProgress[] = [];

    const result = await fetchFleetTrackerLocations({
      force: true,
      onProgress: (next) => progress.push(next),
    });

    expect(result).toEqual({ located, missing });
    expect(progress).toHaveLength(3);
    expect(progress[0]).toEqual({
      done: 0,
      total: 2,
      plate: undefined,
      cars: [
        { id: "car-1", plate: "AA123", make: "Toyota", model: null, status: "pending" },
        { id: "car-2", plate: "BB456", make: null, model: "Leaf", status: "pending" },
      ],
    });
    expect(progress[0]?.cars[0]?.status).toBe("pending");
    expect(progress.at(-1)).toMatchObject({
      done: 2,
      total: 2,
      plate: "BB456",
      cars: [
        { id: "car-1", plate: "AA123", status: "located" },
        { id: "car-2", plate: "BB456", status: "missing", error: "tracker_no_fix" },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://miniapp.test/api/cars/tracker/locations?progress=1&refresh=1");
    expect(init).toMatchObject({
      headers: {
        Authorization: "tma ",
        Accept: "application/x-ndjson",
      },
    });
  });

  it("rejects streams that finish before the done event", async () => {
    stubWindow();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(ndjsonStream([
          `${JSON.stringify({ type: "start", total: 1, cars: [] })}\n`,
        ])),
      ),
    );

    await expect(fetchFleetTrackerLocations()).rejects.toMatchObject(
      new ApiError(502, "incomplete_stream"),
    );
  });
});
