export type WorkflowNotificationType = 'success' | 'failure' | 'complete';

export interface AppNotification {
  id: string;
  type: WorkflowNotificationType;
  title: string;
  message: string;
  timestamp: string;
  repo: string;
  runNumber: number;
  read: boolean;
}

class NotificationService {
  private listeners: ((notification: AppNotification) => void)[] = [];
  private notifications: AppNotification[] = [];

  constructor() {
    // Load cached notifications from sessionStorage
    try {
      const stored = sessionStorage.getItem('gitbuddy_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch {
      this.notifications = [];
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
      return 'denied';
    }
  }

  public subscribe(cb: (notification: AppNotification) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public getNotifications(): AppNotification[] {
    return this.notifications;
  }

  public markAllAsRead(): void {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    try {
      sessionStorage.setItem('gitbuddy_notifications', JSON.stringify(this.notifications));
    } catch {}
  }

  public clearNotifications(): void {
    this.notifications = [];
    try {
      sessionStorage.removeItem('gitbuddy_notifications');
    } catch {}
  }

  // Plays a pleasant audio chime using Web Audio API
  private playChime(type: WorkflowNotificationType): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'success') {
        // High ascending 2-tone chime
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'failure') {
        // Low descending alert tone
        osc.frequency.setValueAtTime(370, now);
        osc.frequency.setValueAtTime(260, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Neutral complete tone
        osc.frequency.setValueAtTime(523.25, now); // C5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Audio autoplay policy may prevent sound prior to user gesture
    }
  }

  public notifyWorkflowEvent(params: {
    type: WorkflowNotificationType;
    workflowName: string;
    repoName: string;
    branch: string;
    runNumber: number;
    conclusion?: string | null;
  }): void {
    const { type, workflowName, repoName, branch, runNumber, conclusion } = params;

    let title = '';
    let message = '';

    if (type === 'success') {
      title = `Workflow Passed: ${workflowName}`;
      message = `Run #${runNumber} on ${repoName} (${branch}) completed successfully! Build artifacts (e.g. APK) are available to download.`;
    } else if (type === 'failure') {
      title = `Workflow Failed: ${workflowName}`;
      message = `Run #${runNumber} on ${repoName} (${branch}) failed with conclusion "${conclusion || 'failure'}".`;
    } else {
      title = `Workflow Complete: ${workflowName}`;
      message = `Run #${runNumber} on ${repoName} finished with status: ${conclusion || 'complete'}.`;
    }

    const item: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      repo: repoName,
      runNumber,
      read: false,
    };

    // Store in-app
    this.notifications.unshift(item);
    if (this.notifications.length > 50) this.notifications.pop();
    try {
      sessionStorage.setItem('gitbuddy_notifications', JSON.stringify(this.notifications));
    } catch {}

    // Broadcast to React listeners
    this.listeners.forEach((cb) => cb(item));

    // Play tone
    this.playChime(type);

    // Browser Web Push Notification
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          tag: `workflow-run-${runNumber}`,
        });
      } catch (err) {
        console.warn('Browser notification error:', err);
      }
    }
  }
}

export const notificationService = new NotificationService();
