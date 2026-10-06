// staresdk/map-view — MapView lives in its own entry point because maplibre-gl is an optional
// peer dependency; importing the main barrel never loads it.
export * from './components/MapView.js'
