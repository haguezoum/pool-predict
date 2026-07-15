import 'dotenv/config'
import { createApp } from './app.js'
import { getEnv } from './env.js'

const env = getEnv()
createApp().listen(env.apiPort, '127.0.0.1', () => {
  console.log(`Pool Predict API listening on http://127.0.0.1:${env.apiPort}`)
})
