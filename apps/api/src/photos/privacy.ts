// The hook for plan 9 (spec 6.3 / 9.1): face and plate blurring will run here. Until it exists
// the image passes through untouched and `blurred` stays false.
export async function processForPrivacy(image: Buffer): Promise<{ image: Buffer; blurred: boolean }> {
  return { image, blurred: false };
}
