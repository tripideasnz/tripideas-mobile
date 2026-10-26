// Two equally prominent entry points on the welcome screen: Discover and Map.
// Each is a supplied glass-style icon (mountain scene, New Zealand outline) used as the
// button itself, side by side, with a text label beneath in the same type as the intro text. The tiles are as large as the
// screen allows (up to 160 pt, which is the artwork's sharp size at 3x) and shrink evenly
// on narrow phones.
import { Image } from 'expo-image';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { WELCOME_DESTINATIONS, type WelcomeDestination } from '@/components/welcome-navigation';

/** The introductory text style, shared by the intro paragraph and the button labels so they match. */
export const WELCOME_BODY_TEXT_STYLE = { color: '#f2f2f2', fontSize: 18, lineHeight: 26 } as const;

/**
 * Spacing inside the text group, tuned so the visible gaps match: logo to title and title to
 * intro are both about 52 pt between the drawn shapes. (The title's 48 pt line box and the
 * logo's own padding make equal margins look uneven, so these margins are deliberately
 * different.)
 */
export const WELCOME_LOGO_MARGIN_BOTTOM = 24;
export const WELCOME_TITLE_MARGIN_BOTTOM = 42;

/** Space between the bottom of the intro text and the top of the Discover and Map buttons. */
export const WELCOME_ICONS_GAP = 80;

export const WELCOME_BUTTON_MAX_SIZE = 160;
export const WELCOME_LABEL_GAP = 12;
export const WELCOME_BUTTON_GAP = 20;
export const WELCOME_SIDE_PADDING = 24;
// Both icons are cut to the same 482 x 466 pixel tile.
export const WELCOME_ICON_ASPECT = 482 / 466;

const ICONS: Record<WelcomeDestination['key'], number> = {
  discover: require('@/assets/images/welcome-discover.png'),
  map: require('@/assets/images/welcome-map.png'),
};

/** Width of each tile for a screen width: as large as fits, never above the maximum. */
export function welcomeButtonWidth(screenWidth: number): number {
  const available = screenWidth - 2 * WELCOME_SIDE_PADDING - WELCOME_BUTTON_GAP;
  return Math.max(0, Math.min(WELCOME_BUTTON_MAX_SIZE, Math.floor(available / 2)));
}

/** Height of the buttons with their labels, for a screen width. */
export function welcomeButtonsBlockHeight(screenWidth: number): number {
  return Math.round(welcomeButtonWidth(screenWidth) / WELCOME_ICON_ASPECT) + WELCOME_LABEL_GAP + WELCOME_BODY_TEXT_STYLE.lineHeight;
}

/**
 * Where the text group (logo, title, intro) starts, measured from the top of the safe area:
 * the logo sits 27.8% of the way down the screen, which is 5% of the screen height lower than
 * the first layout had it.
 */
export const WELCOME_TEXT_TOP_FRACTION = 0.278;
export function welcomeTextTop(screenHeight: number, topInset: number): number {
  return Math.max(16, Math.round(screenHeight * WELCOME_TEXT_TOP_FRACTION - topInset));
}

export function WelcomeEntryButtons({ onOpen }: { onOpen: (destination: WelcomeDestination) => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = welcomeButtonWidth(screenWidth);
  const height = Math.round(width / WELCOME_ICON_ASPECT);
  return (
    <View
      style={{
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: WELCOME_BUTTON_GAP,
        justifyContent: 'center',
      }}>
      {WELCOME_DESTINATIONS.map((destination) => (
        <View key={destination.key} style={{ alignItems: 'center', gap: WELCOME_LABEL_GAP, width }}>
          <Pressable
            accessibilityHint={destination.accessibilityHint}
            accessibilityLabel={destination.accessibilityLabel}
            accessibilityRole="button"
            onPress={() => onOpen(destination)}
            style={({ pressed }) => ({ height, opacity: pressed ? 0.75 : 1, width })}>
            <Image
              accessible={false}
              contentFit="contain"
              source={ICONS[destination.key]}
              style={{ height, width }}
            />
          </Pressable>
          <Text accessible={false} style={{ ...WELCOME_BODY_TEXT_STYLE, textAlign: 'center' }}>
            {destination.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
