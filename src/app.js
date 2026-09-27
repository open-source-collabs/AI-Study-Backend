require('dotenv').config();

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');

const { appConfig } = require('./config/app.config');
const { HTTP_STATUS } = require('./enums/http-statuses');
const { errorMiddleware, notFoundMiddleware } = require('./middleware/error.middleware');

const JSON_BODY_LIMIT = '1mb';

const { nodeEnv, port } = appConfig;

const app = express();

app.disable('x-powered-by');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

app.get('/health', (request, response) => {
  response.status(HTTP_STATUS.OK).json({
    success: true,
    service: 'ai-study-backend',
    status: 'ok',
    uptimeInSeconds: process.uptime(),
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`AI Study Backend is listening on port ${port} (${nodeEnv})`);
});

module.exports = app;
