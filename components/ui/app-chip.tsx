import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, type PressableProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Shadow, Space } from '@/constants/design';

type AppChipProps = Omit<PressableProps, 'children'> & {
  elevated?: boolean;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  selected?: boolean;
};

export function AppChip({
  elevated = false,
  icon,
  label,
  selected = false,
  ...props
}: AppChipProps) {
  const foreground = selected ? Palette.textOnPrimary : Palette.text;

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        ...(elevated ? Shadow.floating : {}),
        alignItems: 'center',
        backgroundColor: selected
          ? Palette.primary
          : elevated
            ? 'rgba(255,255,255,0.96)'
            : Palette.surfaceMuted,
        borderColor: selected ? Palette.primary : Palette.border,
        borderRadius: Radius.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: Space.sm,
        opacity: pressed ? 0.68 : 1,
        paddingHorizontal: Space.md,
        paddingVertical: Space.sm,
      })}>
      {icon ? (
        <MaterialIcons color={foreground} name={icon} size={17} />
      ) : null}
      <AppText color={foreground} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}
