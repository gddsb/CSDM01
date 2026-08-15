export const genTempId = (): string => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
