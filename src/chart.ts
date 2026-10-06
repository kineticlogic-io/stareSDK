// staresdk/chart — TimeSeriesChart lives in its own entry point because uplot is an optional peer
// dependency; importing the main barrel never loads it.
export * from './components/TimeSeriesChart'
