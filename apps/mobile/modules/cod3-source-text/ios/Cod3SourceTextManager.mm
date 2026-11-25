#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface Cod3SourceTextManager : RCTViewManager
@end

@implementation Cod3SourceTextManager

RCT_EXPORT_MODULE(Cod3SourceText)

- (UIView *)view {
  return [[UIView alloc] init];
}

@end

@interface Cod3SourceTextRunManager : RCTViewManager
@end

@implementation Cod3SourceTextRunManager

RCT_EXPORT_MODULE(Cod3SourceTextRun)

- (UIView *)view {
  return nil;
}

@end
