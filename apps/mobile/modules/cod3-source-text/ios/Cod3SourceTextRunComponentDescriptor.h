#pragma once

#include "Cod3SourceTextRunShadowNode.h"

#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {
using Cod3SourceTextRunComponentDescriptor =
    ConcreteComponentDescriptor<Cod3SourceTextRunShadowNode>;

void Cod3SourceTextRunSpec_registerComponentDescriptorsFromCodegen(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
} // namespace facebook::react
