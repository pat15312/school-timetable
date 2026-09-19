import { afterEach, describe, expect, it, vi } from "vitest";
import { AppUpdates } from "./appUpdate";

function fixture(controlled = true) {
  const worker = {
    postMessage: vi.fn(),
    state: "installed",
  } as unknown as ServiceWorker;
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
  }) as unknown as ServiceWorkerContainer;
  const registration = { waiting: worker } as ServiceWorkerRegistration;
  const reload = vi.fn(),
    save = vi.fn(() => true);
  const updates = new AppUpdates(container, reload);
  updates.register(registration);
  const activate = () => {
    Object.assign(registration, { waiting: null });
    Object.assign(worker, { state: "activated" });
    Object.assign(container, { controller: worker });
    container.dispatchEvent(new Event("controllerchange"));
  };
  return { worker, container, registration, reload, save, updates, activate };
}
afterEach(() => vi.useRealTimers());
describe("save and reload", () => {
  it("saves, waits for the native controller change, rechecks storage and reloads once", () => {
    const f = fixture();
    f.updates.apply(f.save);
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(f.reload).not.toHaveBeenCalled();
    f.updates.apply(f.save);
    expect(f.save).toHaveBeenCalledTimes(1);
    f.activate();
    expect(f.save).toHaveBeenCalledTimes(2);
    expect(f.reload).toHaveBeenCalledTimes(1);
  });
  it("reloads an update already activated by another tab only after the user's save", () => {
    const f = fixture();
    f.activate();
    expect(f.reload).not.toHaveBeenCalled();
    f.updates.apply(f.save);
    expect(f.reload).toHaveBeenCalledOnce();
  });
  it("remembers update availability for subscribers mounted after registration", () => {
    const f = fixture();
    expect(f.updates.getSnapshot().ready).toBe(true);
    const listener = vi.fn();
    const unsubscribe = f.updates.subscribe(listener);
    f.updates.apply(f.save);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    f.activate();
  });
  it("never activates or reloads after a failed save", () => {
    const f = fixture();
    f.save.mockReturnValue(false);
    f.updates.apply(f.save);
    expect(f.worker.postMessage).not.toHaveBeenCalled();
    expect(f.reload).not.toHaveBeenCalled();
  });
  it("keeps the page open if another tab changes storage during activation", () => {
    const f = fixture();
    f.updates.apply(f.save);
    f.save.mockReturnValue(false);
    f.activate();
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.updates.getSnapshot().error).toContain("could not be saved");
    f.save.mockReturnValue(true);
    f.updates.apply(f.save);
    expect(f.reload).toHaveBeenCalledOnce();
  });
  it("times out safely and permits retry without reloading a stale worker", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.updates.apply(f.save);
    vi.advanceTimersByTime(15_000);
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.updates.getSnapshot()).toMatchObject({
      ready: true,
      applying: false,
    });
    f.updates.apply(f.save);
    f.activate();
    expect(f.reload).toHaveBeenCalledOnce();
  });
  it("keeps failed activation recoverable", () => {
    const f = fixture();
    vi.mocked(f.worker.postMessage).mockImplementation(() => {
      throw new Error("Gone");
    });
    f.updates.apply(f.save);
    expect(f.updates.getSnapshot().error).toContain("could not start");
    expect(f.reload).not.toHaveBeenCalled();
  });
  it("does not show an update or reload on first installation", () => {
    const container = Object.assign(new EventTarget(), {
      controller: null,
    }) as unknown as ServiceWorkerContainer;
    const reload = vi.fn();
    const updates = new AppUpdates(container, reload);
    Object.assign(container, { controller: {} });
    container.dispatchEvent(new Event("controllerchange"));
    expect(updates.getSnapshot().ready).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
