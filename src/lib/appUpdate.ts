export type UpdateSnapshot = {
  ready: boolean;
  applying: boolean;
  error: string;
};

/** Follow the native controller change, including updates installed by another tab. */
export class AppUpdates {
  private snapshot: UpdateSnapshot = {
    ready: false,
    applying: false,
    error: "",
  };
  private listeners = new Set<() => void>();
  private registration?: ServiceWorkerRegistration;
  private target: ServiceWorker | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private save?: () => boolean;
  private hadController: boolean;
  constructor(
    private workers: ServiceWorkerContainer | undefined,
    private reload: () => void,
  ) {
    this.hadController = !!workers?.controller;
    workers?.addEventListener("controllerchange", () => {
      if (this.snapshot.applying) this.finish();
      else if (this.hadController) this.ready();
      this.hadController = !!workers.controller;
    });
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(change: Partial<UpdateSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }
  ready = () => {
    this.target = this.registration?.waiting ?? this.target;
    this.set({ ready: true });
  };
  register(registration: ServiceWorkerRegistration) {
    this.registration = registration;
    if (registration.waiting) this.ready();
  }
  apply(save: () => boolean) {
    if (!this.snapshot.ready || this.snapshot.applying || !save()) return;
    this.save = save;
    this.target = this.registration?.waiting ?? this.target;
    this.set({ applying: true, error: "" });
    // A different tab may already have activated the offered update.
    if (
      this.workers?.controller &&
      (!this.target || this.workers.controller === this.target)
    ) {
      this.finish();
      return;
    }
    if (!this.target) {
      this.fail("The update is not available yet. Please try again shortly.");
      return;
    }
    this.timer = setTimeout(
      () =>
        this.fail(
          "The update did not finish. Your work is saved; please try again.",
        ),
      15_000,
    );
    try {
      this.target.postMessage({ type: "SKIP_WAITING" });
    } catch {
      this.fail(
        "The update could not start. Your work is saved; please try again.",
      );
    }
  }
  private finish() {
    if (
      !this.snapshot.applying ||
      !this.workers?.controller ||
      (this.target && this.workers.controller !== this.target)
    )
      return;
    clearTimeout(this.timer);
    // Recheck storage: edits or another tab may have changed it during activation.
    if (!this.save?.()) {
      this.fail(
        "Your latest changes could not be saved. Keep this page open and download a backup before reloading.",
      );
      return;
    }
    this.save = undefined;
    this.set({ ready: false, applying: false, error: "" });
    this.reload();
  }
  private fail(error: string) {
    clearTimeout(this.timer);
    this.save = undefined;
    this.set({ applying: false, error });
  }
}

export const appUpdates = new AppUpdates(
  typeof navigator === "undefined" ? undefined : navigator.serviceWorker,
  () => window.location.reload(),
);
