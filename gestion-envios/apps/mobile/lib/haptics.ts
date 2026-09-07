import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const canHaptic = () => Platform.OS !== "web";

export const haptic = {
  light: () => {
    if (canHaptic()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: () => {
    if (canHaptic()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  success: () => {
    if (canHaptic()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => {
    if (canHaptic()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  selection: () => {
    if (canHaptic()) void Haptics.selectionAsync();
  },
};
