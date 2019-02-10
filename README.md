# HYDRA Base Station

HYDRA Base Station is an open source web server licensed under the terms and conditions of the MIT Open Source License and the licenses of the modules you may or may not elect to use.

Base Station does not implement local user accounts with usernames and passwords. You can always add them as a password strategy, but they are not enabled by default. Instead, all HYDRA Base Station nodes use OAuth2 to authenticate users against the Gab.com HTTP API.

HYDRA Base Station is enough of a web server to get users connected with [Gab.com](https://gab.com), show how to build a user profile derived from a Gab.com user profile, and how to associate custom data with a Gab.com user on your own node.

This allows your HYDRA node to specialize the user account record however is needed. Your node will receive the base user profile data from Gab.com when the user connects. You have the opportunity to pick and choose what you want to store locally, then associate whatever you want with these users.

The point is that your site doesn't have to implement new account sign up, user login, logout, status updates, commenting, sharing, and everything else provided by the Gab.com platform.

These are the absolute earliest of days. But, this node can connect with Gab.com and create a User record.

What you do with it from here is entirely up to you.

## Installation

See the INSTALL document located in this directory.