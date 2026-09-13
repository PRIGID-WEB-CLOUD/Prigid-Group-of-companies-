import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushNotificationState = {
  expoPushToken: string | null;
  permissionGranted: boolean | null;
};

export function usePushNotifications(): PushNotificationState {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const pendingTokenRef = useRef<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        pendingTokenRef.current = token;
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification received while app is foregrounded — handled by setNotificationHandler above
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (_response) => {
        // User tapped a notification — expo-router handles deep link via notification.request.content.data.url
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (user && pendingTokenRef.current) {
      sendTokenToServer(pendingTokenRef.current);
    }
  }, [user]);

  async function registerForPushNotificationsAsync(): Promise<string | undefined> {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8B6F47",
      });
    }

    const existing = await Notifications.getPermissionsAsync() as any;
    let granted: boolean = existing.granted ?? (existing.status === "granted");
    setPermissionGranted(granted);

    if (!granted) {
      const result = await Notifications.requestPermissionsAsync() as any;
      granted = result.granted ?? (result.status === "granted");
      setPermissionGranted(granted);
    }

    if (!granted) return undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  }

  async function sendTokenToServer(token: string) {
    try {
      const res = await fetch(apiUrl("/api/push-tokens/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, platform: Platform.OS }),
      });
      if (res.ok) {
        pendingTokenRef.current = null;
      } else {
        console.warn("[PushNotifications] Token registration failed:", res.status, res.statusText);
      }
    } catch (err) {
      console.warn("[PushNotifications] Token registration error:", err);
    }
  }

  return { expoPushToken, permissionGranted };
}
