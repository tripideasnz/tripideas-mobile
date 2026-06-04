import { Text } from 'react-native';

export type ContentBlock = {
  children?: {
    text?: string;
  }[];
  style?: string;
};

export function getBlockText(block: ContentBlock) {
  return (block.children ?? [])
    .map((child) => child.text)
    .filter(Boolean)
    .join('');
}

export function getPlainText(blocks?: ContentBlock[]) {
  return (blocks ?? []).map(getBlockText).filter(Boolean).join('\n\n');
}

export function ContentBlocks({ blocks }: { blocks?: ContentBlock[] }) {
  const safeBlocks = (blocks ?? []).filter((block) => getBlockText(block));

  if (safeBlocks.length === 0) {
    return null;
  }

  return (
    <>
      {safeBlocks.map((block, index) => {
        const text = getBlockText(block);

        if (block.style === 'h3') {
          return (
            <Text
              key={`${block.style}-${index}`}
              style={{
                color: '#111',
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 28,
                marginBottom: 10,
                marginTop: index === 0 ? 0 : 18,
              }}>
              {text}
            </Text>
          );
        }

        return (
          <Text
            key={`${block.style ?? 'normal'}-${index}`}
            style={{
              color: '#333',
              fontSize: 17,
              lineHeight: 25,
              marginBottom: 16,
            }}>
            {text}
          </Text>
        );
      })}
    </>
  );
}
