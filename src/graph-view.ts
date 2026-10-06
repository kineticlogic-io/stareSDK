// staresdk/graph-view — GraphView lives in its own entry point because @xyflow/react and
// @dagrejs/dagre are optional peer dependencies; importing the main barrel never loads them.
export * from './components/GraphView.js'
