package app

// Banner is the ECHO ASCII logo printed after configuration loads
// successfully. Escape codes are normalized to the red/white palette; the
// block art spells E-C-H-O.
const Banner = "\x1b[0;37;40m \x1b[0;31;40m▄▄▄▄▄\x1b[0;37;40m  \x1b[0;31;40m▄▄▄▄▄\x1b[0;37;40m \x1b[0;31;40m▄▄▄▄▄▄\x1b[0;37;40m  \x1b[0;31;40m▄▄▄▄▄\x1b[0m\n" +
	"\x1b[0;91;41m▒\x1b[0;97;41m▄▀▀▀\x1b[0;91;41m░\x1b[0;37;40m \x1b[0;91;41m▒\x1b[0;97;41m▄▀▀▀\x1b[0;91;41m░\x1b[0;37;40m \x1b[0;91;41m░\x1b[0;97;40m█\x1b[0;91;41m░░\x1b[0;97;41m█\x1b[0;91;41m░\x1b[0;37;40m \x1b[0;91;41m░\x1b[0;97;41m▄▀▀\x1b[0;97;41m█\x1b[0;91;41m░\x1b[0m\n" +
	"\x1b[0;91;41m▓\x1b[0;97;41m█\x1b[0;97;41m▀▀\x1b[0;91;41m▒\x1b[0;37;40m  \x1b[0;91;41m▓\x1b[0;97;41m█\x1b[0;91;41m▓\x1b[0;37;40m    \x1b[0;91;41m▒\x1b[0;97;41m█\x1b[0;97;41m▀▀\x1b[0;97;41m█\x1b[0;91;41m▒\x1b[0;37;40m \x1b[0;91;41m▒\x1b[0;97;41m█\x1b[0;91;41m░▒\x1b[0;97;41m█\x1b[0;91;41m▒\x1b[0m\n" +
	"\x1b[0;91;41m█\x1b[0;97;41m█\x1b[0;97;41m▄▄▄\x1b[0;91;41m▓\x1b[0;37;40m \x1b[0;91;41m█\x1b[0;97;40m█\x1b[0;97;41m▄▄▄\x1b[0;91;41m▓\x1b[0;37;40m \x1b[0;91;41m▓\x1b[0;97;41m█\x1b[0;91;41m▒▓\x1b[0;97;41m█\x1b[0;91;41m▓\x1b[0;37;40m \x1b[0;91;41m▓\x1b[0;97;41m█\x1b[0;97;41m▄▄▀\x1b[0;91;41m▓\x1b[0m\n" +
	"\x1b[0;91;40m▀▀▀▀▀▀\x1b[0;37;40m \x1b[0;91;40m▀▀▀▀▀▀\x1b[0;37;40m \x1b[0;91;40m▀▀▀▀▀▀\x1b[0;37;40m \x1b[0;91;40m▀▀▀▀▀\x1b[0;37;40m \x1b[0m"
