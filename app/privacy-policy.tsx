import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { ContentBlocks, type ContentBlock } from '@/components/content-blocks';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Screen, Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';

const PRIVACY_POLICY_QUERY = `*[_type == "customPage" && slug.current == "privacy-policy"][0]{
  title,
  "content": content[_type == "block"]
}`;

type PrivacyPolicy = { content?: ContentBlock[]; title?: string };

export default function PrivacyPolicyScreen() {
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    sanityClient.fetch<PrivacyPolicy | null>(PRIVACY_POLICY_QUERY)
      .then((result) => {
        if (mounted) setPolicy(result);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => { mounted = false; };
  }, []);

  if (!policy && !failed) return <LoadingView />;

  return (
    <ScrollView
      style={{ backgroundColor: Palette.background, flex: 1 }}
      contentContainerStyle={{
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Space.xl,
      }}>
      <AppText style={{ marginBottom: Space.xl }} variant="display">
        {policy?.title ?? 'Privacy Policy'}
      </AppText>
      {failed ? (
        <AppText color={Palette.textBody}>
          The Privacy Policy could not be loaded. Please check your connection and try again.
        </AppText>
      ) : (
        <ContentBlocks blocks={policy?.content} />
      )}
    </ScrollView>
  );
}
