export default () => ({
  port: parseInt(process.env.SERVER_PORT || '3001', 10),
  dataPath: process.env.DATA_PATH || './data',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  sync: {
    interval: parseInt(process.env.SYNC_INTERVAL || '300000', 10),
  },
});
