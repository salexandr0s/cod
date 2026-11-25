Pod::Spec.new do |s|
  s.name = 'Cod3VoiceTranscription'
  s.version = '1.0.0'
  s.summary = 'Local recording conversion for cod3 dictation.'
  s.author = 'T3 Tools'
  s.homepage = 'https://t3tools.com'
  s.platform = :ios, '18.0'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.frameworks = 'AudioToolbox'
end
