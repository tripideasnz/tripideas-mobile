import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAP_STYLES, type MapStyleId } from '@/constants/map';
import { Palette, Radius, Space, Type } from '@/constants/design';

type MapStyleSheetProps = {
  activeStyleId: MapStyleId;
  onClose: () => void;
  onSelectStyle: (id: MapStyleId) => void;
  visible: boolean;
};

export function MapStyleSheet({
  activeStyleId,
  onClose,
  onSelectStyle,
  visible,
}: MapStyleSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <SafeAreaView style={{ backgroundColor: Palette.surface, flex: 1 }}>
        <View
          style={{
            alignItems: 'center',
            borderBottomColor: Palette.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>Close</Text>
          </Pressable>
          <Text style={{ fontSize: 19, fontWeight: '800' }}>Map style</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={{ padding: Space.xxl }}>
          <Text style={{ ...Type.label, color: Palette.textMuted, marginBottom: Space.md }}>
            Base map
          </Text>

          {MAP_STYLES.map((style) => {
            const isActive = style.id === activeStyleId;
            return (
              <Pressable
                key={style.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                onPress={() => {
                  onSelectStyle(style.id);
                  onClose();
                }}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  borderColor: isActive ? Palette.primary : Palette.border,
                  borderRadius: Radius.control,
                  borderWidth: isActive ? 2 : 1,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: Space.md,
                  opacity: pressed ? 0.7 : 1,
                  paddingHorizontal: Space.lg,
                  paddingVertical: Space.md,
                })}>
                <Text style={{ ...Type.body, color: Palette.text }}>{style.label}</Text>
                {isActive ? (
                  <MaterialIcons color={Palette.primary} name="check" size={22} />
                ) : null}
              </Pressable>
            );
          })}

          <Text
            style={{
              ...Type.caption,
              color: Palette.textMuted,
              marginTop: Space.md,
            }}>
            Coming soon: cycle tracks, walking tracks, paper roads, DOC conservation overlays.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
