// Opt-in mechanism to force synchronous React mounts for selected components.
//
// React 18's createRoot().render() schedules work via React's concurrent
// scheduler, which yields between roots. When an Ember template contains
// many sibling {{[name]}} React invocations, each root's mount + paint +
// passive-effect cycle completes before the next root's render starts,
// producing a visible "wave" effect (see Optibus OS-83133).
//
// Host apps can register a predicate via setSyncMountPredicate; when the
// predicate returns true for a resolved component name, that mount wraps
// the .render() call in flushSync so all matching siblings mount in the
// same task and the browser paints once.

let predicate = () => false;

export function setSyncMountPredicate(fn) {
  predicate = typeof fn === 'function' ? fn : () => false;
}

export function shouldSyncMount(name) {
  return predicate(name);
}
