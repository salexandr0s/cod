#import "Cod3SourceText.h"
#import <React/RCTFabricComponentsPlugins.h>
#import "Cod3SourceTextComponentDescriptor.h"
#import "Cod3SourceTextShadowNode.h"
#import <React/RCTConversions.h>
#import <objc/runtime.h>
#import <react/renderer/components/Cod3SourceTextSpec/EventEmitters.h>
#import <react/renderer/components/Cod3SourceTextSpec/Props.h>
#import <react/renderer/components/Cod3SourceTextSpec/RCTComponentViewHelpers.h>
#import <react/renderer/textlayoutmanager/RCTAttributedTextUtils.h>

using namespace facebook::react;

@interface Cod3SourceTextView : UITextView
@end

@implementation Cod3SourceTextView
- (BOOL)canPerformAction:(SEL)action withSender:(id)sender {
  // Read-only UITextViews must still allow selecting the whole file.
  if (action == @selector(selectAll:)) {
    return self.selectable && self.text.length > 0 &&
           self.selectedRange.length < self.text.length;
  }
  return [super canPerformAction:action withSender:sender];
}
@end

@protocol Cod3SourceTextOutsideTapTarget <NSObject>
- (void)clearSelectionForOutsideTapWithHitView:(UIView *)hitView;
@end

@interface Cod3SourceTextOutsideTapCoordinator
    : NSObject <UIGestureRecognizerDelegate>

- (instancetype)initWithWindow:(UIWindow *)window;
- (void)addTarget:(id<Cod3SourceTextOutsideTapTarget>)target;
- (void)removeTarget:(id<Cod3SourceTextOutsideTapTarget>)target;

@end

static const void *Cod3SourceTextOutsideTapCoordinatorKey =
    &Cod3SourceTextOutsideTapCoordinatorKey;

@implementation Cod3SourceTextOutsideTapCoordinator {
  __weak UIWindow *_window;
  UITapGestureRecognizer *_recognizer;
  NSHashTable<id<Cod3SourceTextOutsideTapTarget>> *_targets;
}

- (instancetype)initWithWindow:(UIWindow *)window {
  if (self = [super init]) {
    _window = window;
    _targets = [NSHashTable weakObjectsHashTable];
    _recognizer =
        [[UITapGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handleTap:)];
    _recognizer.cancelsTouchesInView = NO;
    _recognizer.delegate = self;
    [window addGestureRecognizer:_recognizer];
  }
  return self;
}

- (void)addTarget:(id<Cod3SourceTextOutsideTapTarget>)target {
  [_targets addObject:target];
}

- (void)removeTarget:(id<Cod3SourceTextOutsideTapTarget>)target {
  [_targets removeObject:target];
  if (_targets.count > 0) {
    return;
  }

  UIWindow *window = _window;
  [window removeGestureRecognizer:_recognizer];
  if (objc_getAssociatedObject(window, Cod3SourceTextOutsideTapCoordinatorKey) ==
      self) {
    objc_setAssociatedObject(window, Cod3SourceTextOutsideTapCoordinatorKey, nil,
                             OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
}

- (void)handleTap:(UITapGestureRecognizer *)sender {
  UIWindow *window = _window;
  if (window == nil) {
    return;
  }

  UIView *hitView = [window hitTest:[sender locationInView:window]
                          withEvent:nil];
  if (hitView == nil) {
    return;
  }
  for (id<Cod3SourceTextOutsideTapTarget> target in _targets.allObjects) {
    [target clearSelectionForOutsideTapWithHitView:hitView];
  }
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:
        (UIGestureRecognizer *)otherGestureRecognizer {
  return YES;
}

@end

static Cod3SourceTextOutsideTapCoordinator *
Cod3SourceTextOutsideTapCoordinatorForWindow(UIWindow *window) {
  Cod3SourceTextOutsideTapCoordinator *coordinator =
      objc_getAssociatedObject(window, Cod3SourceTextOutsideTapCoordinatorKey);
  if (coordinator == nil) {
    coordinator =
        [[Cod3SourceTextOutsideTapCoordinator alloc] initWithWindow:window];
    objc_setAssociatedObject(window, Cod3SourceTextOutsideTapCoordinatorKey,
                             coordinator, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return coordinator;
}

@interface Cod3SourceText () <RCTCod3SourceTextViewProtocol, UITextViewDelegate,
                            Cod3SourceTextOutsideTapTarget>
@end

@implementation Cod3SourceText {
  UIView *_view;
  Cod3SourceTextView *_textView;
  BOOL _textLayoutNeedsUpdate;
  Cod3SourceTextShadowNode::ConcreteState::Shared _state;
  __weak UIWindow *_outsideTapWindow;
  BOOL _suppressSelectionChange;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<Cod3SourceTextComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const Cod3SourceTextProps>();
    _props = defaultProps;
    _view = [[UIView alloc] init];
    self.contentView = _view;
    self.clipsToBounds = YES;
    _textView = [[Cod3SourceTextView alloc] init];
    _textView.scrollEnabled = NO;
    _textView.editable = NO;
    _textView.textContainerInset = UIEdgeInsetsZero;
    _textView.textContainer.lineFragmentPadding = 0;
    _textView.textContainer.lineBreakMode = NSLineBreakByTruncatingTail;
    _textView.textContainer.widthTracksTextView = NO;
    _textView.textContainer.heightTracksTextView = NO;
    _textView.delegate = self;
    _textView.textDragInteraction.enabled = NO;
    _textView.layoutManager.usesFontLeading = NO;
    [self addSubview:_textView];
  }
  return self;
}

- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (_outsideTapWindow == self.window)
    return;
  Cod3SourceTextOutsideTapCoordinator *coordinator = objc_getAssociatedObject(
      _outsideTapWindow, Cod3SourceTextOutsideTapCoordinatorKey);
  [coordinator removeTarget:self];
  _outsideTapWindow = self.window;
  if (_outsideTapWindow != nil) {
    [Cod3SourceTextOutsideTapCoordinatorForWindow(_outsideTapWindow)
        addTarget:self];
  }
}

- (void)dealloc {
  Cod3SourceTextOutsideTapCoordinator *coordinator = objc_getAssociatedObject(
      _outsideTapWindow, Cod3SourceTextOutsideTapCoordinatorKey);
  [coordinator removeTarget:self];
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  Cod3SourceTextOutsideTapCoordinator *coordinator = objc_getAssociatedObject(
      _outsideTapWindow, Cod3SourceTextOutsideTapCoordinatorKey);
  [coordinator removeTarget:self];
  _outsideTapWindow = nil;
  _state.reset();
  _textView.frame = CGRectZero;
  _textView.attributedText = nil;
  _textLayoutNeedsUpdate = YES;
}

- (void)layoutSubviews {
  [super layoutSubviews];
  if (!CGRectEqualToRect(_textView.frame, _view.frame)) {
    _textView.frame = _view.frame;
    _textLayoutNeedsUpdate = YES;
    [self setNeedsDisplay];
  }
}

- (void)drawRect:(CGRect)rect {
  if (!_state)
    return;
  NSMutableAttributedString *text = [RCTNSAttributedStringFromAttributedString(
      _state->getData().attributedString) mutableCopy];
  RCTApplyBaselineOffset(text);
  const BOOL textChanged =
      ![_textView.attributedText isEqualToAttributedString:text];
  const BOOL frameChanged = _textLayoutNeedsUpdate;
  if (!textChanged && !frameChanged)
    return;
  if (textChanged) {
    const NSRange savedRange = _textView.selectedRange;
    _suppressSelectionChange = YES;
    _textView.attributedText = text;
    if (savedRange.location != NSNotFound && savedRange.length > 0 &&
        NSMaxRange(savedRange) <= text.length) {
      _textView.selectedRange = savedRange;
    }
    _suppressSelectionChange = NO;
  }
  if (frameChanged)
    _textView.textContainer.size = CGSizeMake(CGRectGetWidth(_view.frame), CGFLOAT_MAX);
  _textLayoutNeedsUpdate = NO;
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<Cod3SourceTextProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<Cod3SourceTextProps const>(props);
  if (oldViewProps.numberOfLines != newViewProps.numberOfLines) {
    _textView.textContainer.maximumNumberOfLines = newViewProps.numberOfLines;
  }
  if (oldViewProps.selectable != newViewProps.selectable)
    _textView.selectable = newViewProps.selectable;
  if (oldViewProps.allowFontScaling != newViewProps.allowFontScaling) {
    _textView.adjustsFontForContentSizeCategory = newViewProps.allowFontScaling;
  }
  if (oldViewProps.ellipsizeMode != newViewProps.ellipsizeMode) {
    switch (newViewProps.ellipsizeMode) {
    case Cod3SourceTextEllipsizeMode::Head:
      _textView.textContainer.lineBreakMode = NSLineBreakByTruncatingHead;
      break;
    case Cod3SourceTextEllipsizeMode::Middle:
      _textView.textContainer.lineBreakMode = NSLineBreakByTruncatingMiddle;
      break;
    case Cod3SourceTextEllipsizeMode::Tail:
      _textView.textContainer.lineBreakMode = NSLineBreakByTruncatingTail;
      break;
    case Cod3SourceTextEllipsizeMode::Clip:
      _textView.textContainer.lineBreakMode = NSLineBreakByClipping;
      break;
    }
  }
  if (oldViewProps.backgroundColor != newViewProps.backgroundColor) {
    _textView.backgroundColor =
        RCTUIColorFromSharedColor(newViewProps.backgroundColor);
  }
  [super updateProps:props oldProps:oldProps];
}

- (void)updateState:(const facebook::react::State::Shared &)state
           oldState:(const facebook::react::State::Shared &)oldState {
  _state =
      std::static_pointer_cast<const Cod3SourceTextShadowNode::ConcreteState>(
          state);
  [self setNeedsDisplay];
}

- (void)clearSelectionForOutsideTapWithHitView:(UIView *)hitView {
  if ([hitView isDescendantOfView:self])
    return;
  UITextView *textView = _textView;
  // Allow a pending native Copy action to consume its selection first.
  dispatch_async(dispatch_get_main_queue(), ^{
    UITextRange *range = textView.selectedTextRange;
    if (range != nil && !range.isEmpty)
      textView.selectedTextRange = nil;
  });
}

- (void)textViewDidChangeSelection:(UITextView *)textView {
  if (_suppressSelectionChange || _eventEmitter == nullptr)
    return;
  const NSRange range = textView.selectedRange;
  if (range.location == NSNotFound)
    return;
  std::dynamic_pointer_cast<const facebook::react::Cod3SourceTextEventEmitter>(
      _eventEmitter)
      ->onSelectionChange(
          facebook::react::Cod3SourceTextEventEmitter::OnSelectionChange{
              static_cast<int>(self.tag), static_cast<int>(range.location),
              static_cast<int>(NSMaxRange(range))});
}

Class<RCTComponentViewProtocol> Cod3SourceTextCls(void) {
  return Cod3SourceText.class;
}
@end
