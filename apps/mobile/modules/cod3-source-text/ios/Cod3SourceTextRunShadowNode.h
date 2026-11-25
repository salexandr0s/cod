#pragma once

#include <react/renderer/components/Cod3SourceTextSpec/EventEmitters.h>
#include <react/renderer/components/Cod3SourceTextSpec/Props.h>
#include <react/renderer/components/Cod3SourceTextSpec/States.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

namespace facebook::react {
extern const char Cod3SourceTextRunComponentName[];

using Cod3SourceTextRunShadowNode =
    ConcreteViewShadowNode<Cod3SourceTextRunComponentName, Cod3SourceTextRunProps,
                           Cod3SourceTextRunEventEmitter, Cod3SourceTextRunState>;
} // namespace facebook::react
