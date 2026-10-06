// staresdk/code-editor — CodeEditor lives in its own entry point because CodeMirror 6 is an
// optional peer dependency; importing the main barrel never loads it.
export * from './components/CodeEditor'
