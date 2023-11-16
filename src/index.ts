import Moralis from 'moralis';
import express from 'express';
import cors from 'cors';
import config from './config';
import { parseServer } from './parseServer';
// @ts-ignore
import ParseServer from 'parse-server';
import http from 'http';
import ngrok from 'ngrok';

// import { streamsSync } from '@moralisweb3/parse-server';
import customEventSync from './customEventSync';

import { parseDashboard } from "./parseDashboard";



export const app = express();

Moralis.start({
  apiKey: config.MORALIS_API_KEY,
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors());



// // Add the logging middleware before the streamsSync() middleware
app.use(config.STREAMS_WEBHOOK_URL, customEventSync);

// app.use(
//   streamsSync(parseServer, {
//     apiKey: config.MORALIS_API_KEY,
//     webhookUrl: config.STREAMS_WEBHOOK_URL,
//   }),
// );

app.use(`/dashboard`, parseDashboard);

app.use(`/server`, parseServer.app);


const httpServer = http.createServer(app);
httpServer.listen(config.PORT, async () => {
  if (config.USE_STREAMS) {
    const url = await ngrok.connect(config.PORT);
    // eslint-disable-next-line no-console
    console.log(
      `Moralis Server is running on port ${config.PORT} and stream webhook url ${url}${config.STREAMS_WEBHOOK_URL}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`Moralis Server is running on port ${config.PORT}.`);
  }
});
// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
