/**
 * 从 mainServerUrl 提取目录安全的主机标识：去协议、端口、尾部斜线。
 * 例：http://192.168.2.77:3087 → 192.168.2.77
 *
 * 数据目录隔离标识：每用户数据落在 data/<hostDir>/<userId>/，
 * 防止不同主端下相同 userId 的数据互相碰撞。
 */
export function hostDirFromUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}
