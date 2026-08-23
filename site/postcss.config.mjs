/**
 * The site uses hand-written CSS, no Tailwind and no PostCSS plugins.
 *
 * This file exists to stop PostCSS resolution walking up into the parent
 * workspace, where an unrelated project's config would otherwise be applied.
 */
export default { plugins: {} };
