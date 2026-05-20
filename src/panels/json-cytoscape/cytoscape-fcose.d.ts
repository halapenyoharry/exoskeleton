// Minimal type shim for cytoscape-fcose — the package ships no types of
// its own. We only use the default export as a `cytoscape.use()` extension
// registrar, so a loose declaration is enough.

declare module "cytoscape-fcose" {
  import type cytoscape from "cytoscape";
  const ext: cytoscape.Ext;
  export default ext;
}
