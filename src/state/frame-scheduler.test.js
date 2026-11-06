import { describe, test, expect, vi } from 'vitest';
import { createFrameScheduler } from './frame-scheduler.js';

function fakeFrames() {
  const queue = [];
  const requestFrame = vi.fn((cb) => queue.push(cb));
  const fire = () => {
    const cbs = queue.splice(0);
    for (const cb of cbs) cb();
  };
  return { requestFrame, fire, queue };
}

describe('createFrameScheduler (01-14, one recompute per frame)', () => {
  test('three schedules in one frame request one frame and run once with the earliest timestamp', () => {
    const f = fakeFrames();
    const run = vi.fn();
    const schedule = createFrameScheduler(f.requestFrame, run, () => 100);
    schedule(10);
    schedule(5);
    schedule(12);
    expect(f.requestFrame).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    f.fire();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ inputTs: 5, frameStart: 100 });
  });

  test('a later schedule requests a new frame', () => {
    const f = fakeFrames();
    const run = vi.fn();
    let now = 100;
    const schedule = createFrameScheduler(f.requestFrame, run, () => now);
    schedule(10);
    f.fire();
    now = 200;
    schedule(150);
    expect(f.requestFrame).toHaveBeenCalledTimes(2);
    f.fire();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ inputTs: 150, frameStart: 200 });
  });

  test('a throwing run does not block the next frame', () => {
    const f = fakeFrames();
    const run = vi.fn(() => {
      throw new Error('boom');
    });
    const schedule = createFrameScheduler(f.requestFrame, run, () => 0);
    schedule(1);
    expect(() => f.fire()).toThrow('boom');
    run.mockImplementation(() => {});
    schedule(2);
    expect(f.requestFrame).toHaveBeenCalledTimes(2);
    f.fire();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ inputTs: 2, frameStart: 0 });
  });
});
