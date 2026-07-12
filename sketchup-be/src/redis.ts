import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const RAW_REDIS_URL = process.env.REDIS_URL;
if(!RAW_REDIS_URL){
    console.error('❌ Error: REDIS_URL is missing');
    process.exit(1);
}
const REDIS_URL: string = RAW_REDIS_URL;

export const redisClient = createClient({ url: REDIS_URL });
export const pubClient = createClient({ url: REDIS_URL });
export const subClient = createClient({ url: REDIS_URL });

export const connectRedis = async (): Promise<void> => {
  try {
    await Promise.all([
      redisClient.connect(),
      pubClient.connect(),
      subClient.connect()
    ]);
    console.log('Redis engine connected safely to the cloud cluster!');
  } catch (error) {
    console.error('❌ Failed to log into cloud Redis:', error);
    process.exit(1);
  }
};