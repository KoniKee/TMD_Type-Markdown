import { version } from '../../package.json';

export interface UpdateInfo {
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
}

export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace('v', '').split('.').map(Number);
  const parts2 = v2.replace('v', '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
    if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
  }
  return 0;
}

interface CachedUpdate extends UpdateInfo {
  checkTime: number;
}

function getCachedUpdate(): CachedUpdate | null {
  try {
    const cached = localStorage.getItem('update-cache');
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedUpdate;
    const now = Date.now();

    if (now - data.checkTime > 60 * 60 * 1000) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function setCachedUpdate(info: UpdateInfo): void {
  const cached: CachedUpdate = {
    ...info,
    checkTime: Date.now(),
  };
  localStorage.setItem('update-cache', JSON.stringify(cached));
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const cached = getCachedUpdate();
    if (cached) {
      return compareVersions(cached.latestVersion, `v${version}`) > 0 ? cached : null;
    }

    const response = await fetch(
      'https://api.github.com/repos/KoniKee/TMD_Type-Markdown/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      console.warn('GitHub API request failed:', response.status);
      return null;
    }

    const data = await response.json();
    const info: UpdateInfo = {
      latestVersion: data.tag_name,
      releaseNotes: data.body || '',
      downloadUrl: data.html_url,
      publishedAt: data.published_at,
    };

    setCachedUpdate(info);

    return compareVersions(info.latestVersion, `v${version}`) > 0 ? info : null;
  } catch (error) {
    console.error('Check update failed:', error);
    return null;
  }
}

export function getCurrentVersion(): string {
  return version;
}
