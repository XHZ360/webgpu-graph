export type PreviewFrame = {
  html: string;
};

export function createPreviewFrame(html: string): PreviewFrame {
  return { html };
}
