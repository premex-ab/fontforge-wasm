// SPDX-License-Identifier: GPL-3.0-or-later
// Browser builds cannot spawn processes. Fail explicitly rather than pretending
// that unsupported operations succeeded. These symbols also satisfy GLib tools.
#include <errno.h>
#include <pthread.h>
#include <spawn.h>
#include <stddef.h>

int pthread_getname_np(pthread_t thread, char *buffer, size_t length) {
    (void)thread;
    if (length && buffer) buffer[0] = 0;
    return ENOSYS;
}
int posix_spawnp(pid_t *pid, const char *path,
                 const posix_spawn_file_actions_t *actions,
                 const posix_spawnattr_t *attributes,
                 char *const arguments[], char *const environment[]) {
    (void)pid; (void)path; (void)actions; (void)attributes;
    (void)arguments; (void)environment;
    return ENOSYS;
}
// No DNS resolver is provided by this offline engine.
int res_query(const char *name, int dns_class, int type, unsigned char *answer, int capacity) {
    (void)name; (void)dns_class; (void)type; (void)answer; (void)capacity;
    errno = ENOSYS;
    return -1;
}
