import { GeoPlacesClient, SearchTextCommand } from "@aws-sdk/client-geo-places";

async function test() {
  const client = new GeoPlacesClient({ 
    region: 'eu-north-1', 
    credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
    requestHandler: {
      handle: async (req) => {
        console.log('Sending request to:', req.hostname, req.path);
        throw new Error('intercepted');
      }
    }
  });
  
  try {
    await client.send(new SearchTextCommand({ QueryText: 'restaurant' }));
  } catch (e) {
    if (e.message !== 'intercepted') console.error(e);
  }
}

test();
