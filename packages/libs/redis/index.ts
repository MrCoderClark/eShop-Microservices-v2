import Redis from 'ioredis';

// export const redis = new Redis({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: Number(process.env.REDIS_PORT) || 6379,
//   password: process.env.REDIS_PASSWORD,
// });

console.log(process.env.REDIS_URL);
const redis = new Redis(process.env.REDIS_URL as string);

export default redis;
