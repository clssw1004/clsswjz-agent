<template>
  <div class="app-shell">
    <div class="app-bg" aria-hidden="true"></div>
    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  z-index: 0;
  min-height: 100vh;
}
</style>
