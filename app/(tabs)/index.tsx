import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { sanityClient } from '@/sanity/client';

type Region = {
  _id: string;
   name:string;
   maori?: string;
  slug?: {
    current?: string;
  };
};

type Island = {
  title: string;
  maori?: string;
  regions: Region[];
};

export default function DiscoverScreen() {
  const [islands, setIslands] = useState<{
    north: Island;
    south: Island;
  } | null>(null);

  useEffect(() => {
    sanityClient
      .fetch(`
  *[_type == "islands"][0]{
    north{
      title,
      maori,
      regions[]->{
        _id,
        name,
        maori,
        slug
      }
    },
    south{
      title,
      maori,
      regions[]->{
        _id,
        name,
        maori,
        slug
      }
    }
  }
`)
.then((data) => {
  console.log(JSON.stringify(data, null, 2));
  setIslands(data);
})
.catch(console.error);
  }, []);

  return (
    <ScrollView style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
        TripIdeas
      </Text>

      <Text style={{ fontSize: 18, marginBottom: 24 }}>
        Explore New Zealand by island and region.
      </Text>

      {!islands ? (
        <Text>Loading...</Text>
      ) : (
        <>
  {islands.north ? <IslandSection island={islands.north} /> : null}
  {islands.south ? <IslandSection island={islands.south} /> : null}
</>
      )}
    </ScrollView>
  );
}

function IslandSection({ island }: { island: Island }) {
  const regions = (island.regions ?? []).filter(Boolean);

  return (
    <View style={{ marginBottom: 32 }}>
      <Text style={{ fontSize: 24, fontWeight: '700' }}>{island.title}</Text>

      {island.maori ? (
        <Text style={{ fontSize: 16, marginTop: 4, marginBottom: 12 }}>
          {island.maori}
        </Text>
      ) : null}

      {regions.map((region, index) => (
  <View
  key={region._key ?? region._id ?? index}
  style={{
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  }}>
  <Text style={{ fontSize: 17 }}>
    {region.name ?? 'Untitled region'}
  </Text>

  {region.maori ? (
    <Text style={{ fontSize: 14 }}>
      {region.maori}
    </Text>
  ) : null}
</View>
))}
    </View>
  );
}