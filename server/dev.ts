import 'dotenv/config'
import { createApp } from './app.ts'
import { getEnv } from './env.ts'

const env = getEnv()
createApp().listen(env.apiPort, '127.0.0.1', () => {
  console.log(`Pool Predict API listening on http://127.0.0.1:${env.apiPort}`)
})
