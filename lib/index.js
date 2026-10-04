/**
 * Host companion for the browser-use bundle.
 *
 * This package contributes no behaviour of its own: everything it does happens
 * in the two rows its cordis.patch.yml inserts. It exists so the profile has one
 * bundle to install, update and remove, with the pinned provider packages
 * vendored inside it.
 */
export function apply() {}
