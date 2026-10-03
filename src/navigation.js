// In-memory parents only: no URLs, browser history or persisted application data.
export function createNavigation(initial) {
  let current = initial;
  const parents = [];
  return {
    get parent() { return parents.at(-1); },
    get root() { return parents[0] || current; },
    enter(target, { replace = false, reset = false, returnFocus = null } = {}) {
      if (reset) parents.length = 0;
      else if (!replace) parents.push({ ...current, returnFocus });
      current = target;
    },
    back() {
      const parent = parents.pop();
      if (parent) current = parent;
      return parent;
    }
  };
}
