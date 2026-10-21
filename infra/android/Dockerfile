# Builds the Android app without Android Studio (plan 7, spec 8.4): JDK 21 and the SDK pieces
# Capacitor 8 needs (compileSdk 36, AGP 8.13). Used by scripts/build-apk.sh; Gradle's cache lives in
# the `jaeng_gradle` volume so only the first build downloads it.
FROM eclipse-temurin:21-jdk

# command-line tools build 11076708 (Android's "latest" zip when this was written)
ARG CMDLINE_TOOLS=11076708

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV ANDROID_HOME=/opt/android-sdk \
    GRADLE_USER_HOME=/gradle \
    HOME=/tmp
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" /gradle \
    && curl -fsSL -o /tmp/tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip" \
    && unzip -q /tmp/tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
    && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
    && rm /tmp/tools.zip

RUN yes | sdkmanager --licenses > /dev/null \
    && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# the build runs as the host user (so files written into the bind mount are theirs), not root
RUN chmod -R a+rwX /gradle "${ANDROID_HOME}"
