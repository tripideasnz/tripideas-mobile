import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import type { PlaceGalleryImage } from '@/sanity/types';

function PhotoTile({
  height,
  image,
  index,
  onPress,
  overlayText,
  placeTitle,
}: {
  height: number;
  image: PlaceGalleryImage;
  index: number;
  onPress: () => void;
  overlayText?: string;
  placeTitle?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${
        placeTitle ?? 'place'
      } photo ${index + 1}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height,
        opacity: pressed ? 0.82 : 1,
        overflow: 'hidden',
      })}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="cover"
        source={{ uri: image.url }}
        style={{
          backgroundColor: Palette.surfaceMuted,
          borderRadius: Radius.card,
          height: '100%',
          width: '100%',
        }}
        transition={150}
      />
      {overlayText ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.52)',
            borderRadius: Radius.card,
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}>
          <Text style={{ color: Palette.textOnPrimary, ...Type.bodyStrong }}>
            {overlayText}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function PlacePhotoGrid({
  images,
  placeTitle,
}: {
  images: PlaceGalleryImage[];
  placeTitle?: string;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const viewerRef = useRef<FlatList<PlaceGalleryImage>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const contentWidth = windowWidth - Screen.gutter * 2;
  const gap = Space.sm;
  const halfWidth = (contentWidth - gap) / 2;
  const previewImages = images.slice(0, 4);
  const additionalPhotoCount = Math.max(0, images.length - 4);
  const viewerWidth = Math.min(windowWidth - Space.xxl, 720);
  const viewerHeight = Math.min(windowHeight * 0.72, viewerWidth * 1.25);
  const closeViewer = () => {
    setIsViewerOpen(false);
  };

  useEffect(() => {
    if (!isViewerOpen) {
      return;
    }

    requestAnimationFrame(() => {
      viewerRef.current?.scrollToIndex({
        animated: false,
        index: activeIndex,
      });
    });
  }, [activeIndex, isViewerOpen]);

  if (images.length === 0) {
    return null;
  }

  const tile = (
    image: PlaceGalleryImage,
    index: number,
    height: number,
    overlayText?: string
  ) => (
    <PhotoTile
      height={height}
      image={image}
      index={index}
      key={image._key ?? image.url ?? index}
      onPress={() => {
        setActiveIndex(index);
        setIsViewerOpen(true);
      }}
      overlayText={overlayText}
      placeTitle={placeTitle}
    />
  );

  return (
    <>
      <View
        style={{
          flexDirection: images.length === 1 ? 'column' : 'row',
          gap,
          marginBottom: Space.xxl,
          overflow: 'hidden',
        }}>
        {images.length === 1 ? (
          tile(previewImages[0], 0, contentWidth * 0.75)
        ) : images.length === 2 ? (
          previewImages.map((image, index) =>
            tile(image, index, halfWidth * 1.15)
          )
        ) : images.length === 3 ? (
          <>
            {tile(previewImages[0], 0, halfWidth * 1.4)}
            <View style={{ flex: 1, gap }}>
              {tile(previewImages[1], 1, (halfWidth * 1.4 - gap) / 2)}
              {tile(previewImages[2], 2, (halfWidth * 1.4 - gap) / 2)}
            </View>
          </>
        ) : (
          <>
            <View style={{ flex: 1, gap }}>
              {tile(previewImages[0], 0, halfWidth)}
              {tile(previewImages[2], 2, halfWidth)}
            </View>
            <View style={{ flex: 1, gap }}>
              {tile(previewImages[1], 1, halfWidth)}
              {tile(
                previewImages[3],
                3,
                halfWidth,
                additionalPhotoCount > 0
                  ? `+${additionalPhotoCount} photos`
                  : undefined
              )}
            </View>
          </>
        )}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeViewer}
        presentationStyle="fullScreen"
        visible={isViewerOpen}>
        <SafeAreaView style={{ backgroundColor: '#000', flex: 1 }}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingVertical: Space.lg,
            }}>
            <View style={{ alignSelf: 'center', width: viewerWidth }}>
              <View
                pointerEvents="box-none"
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  minHeight: 52,
                  paddingHorizontal: Space.sm,
                  position: 'relative',
                  zIndex: 2,
                }}>
                <Text style={{ color: '#fff', ...Type.label }}>
                  {activeIndex + 1} / {images.length}
                </Text>
                <Pressable
                  accessibilityLabel="Close photo viewer"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={closeViewer}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderRadius: Radius.pill,
                    elevation: 2,
                    height: 44,
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                    width: 44,
                    zIndex: 3,
                  })}>
                  <MaterialIcons color="#fff" name="close" size={26} />
                </Pressable>
              </View>

              <FlatList
                data={images}
                getItemLayout={(_, index) => ({
                  index,
                  length: viewerWidth,
                  offset: viewerWidth * index,
                })}
                horizontal
                initialScrollIndex={activeIndex}
                keyExtractor={(image, index) =>
                  image._key ?? image.url ?? String(index)
                }
                onMomentumScrollEnd={(event) => {
                  setActiveIndex(
                    Math.round(
                      event.nativeEvent.contentOffset.x / viewerWidth
                    )
                  );
                }}
                pagingEnabled
                ref={viewerRef}
                renderItem={({ item, index }) => (
                  <View
                    style={{
                      alignItems: 'center',
                      height: viewerHeight,
                      justifyContent: 'center',
                      width: viewerWidth,
                    }}>
                    <Image
                      accessibilityLabel={
                        item.alt ??
                        `${placeTitle ?? 'Place'} photo ${index + 1} of ${
                          images.length
                        }`
                      }
                      contentFit="contain"
                      source={{ uri: item.url }}
                      style={{ height: '100%', width: '100%' }}
                    />
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
                style={{ height: viewerHeight }}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
