#import "Cod3SourceTextRun.h"
#import <React/RCTFabricComponentsPlugins.h>
#import "Cod3SourceTextRunComponentDescriptor.h"
#import <react/renderer/components/Cod3SourceTextSpec/Props.h>
#import <react/renderer/components/Cod3SourceTextSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface Cod3SourceTextRun () <RCTCod3SourceTextRunViewProtocol>

@end

@implementation Cod3SourceTextRun {
  NSString *_text;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      Cod3SourceTextRunComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const Cod3SourceTextRunProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<Cod3SourceTextRunProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<Cod3SourceTextRunProps const>(props);

  if (newViewProps.text != oldViewProps.text) {
    NSString *text = [NSString stringWithUTF8String:newViewProps.text.c_str()];
    _text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

Class<RCTComponentViewProtocol> Cod3SourceTextRunCls(void) {
  return Cod3SourceTextRun.class;
}

@end
