#!/bin/bash -e

# Install Tailscale
if ! command -v tailscale &> /dev/null ; then
  echo "Installing Tailscale..."
  curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
  curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list
  sudo apt-get update
  sudo apt-get install -y tailscale
fi

# Set up network config
echo "Enabling IP forwarding..."
if [[ -d /etc/sysctl.d ]]; then
  echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
  echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
  sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
else 
  echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
  echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p /etc/sysctl.conf
fi

if [[ $(systemctl is-enabled networkd-dispatcher) == "enabled" ]]; then
  echo "Updating UDP GRO forwarding..."
  printf '#!/bin/sh\n\nethtool -K %s rx-udp-gro-forwarding on rx-gro-list off \n' "$(ip -o route get 8.8.8.8 | cut -f 5 -d " ")" | sudo tee /etc/networkd-dispatcher/routable.d/50-tailscale
  sudo chmod 755 /etc/networkd-dispatcher/routable.d/50-tailscale
  sudo /etc/networkd-dispatcher/routable.d/50-tailscale
  test $? -eq 0 || echo 'An error occurred.'
fi

# Start Tailscale as exit node
echo "Starting Tailscale, you will be prompted to authenticate..."
sudo tailscale login
sudo tailscale up --advertise-exit-node
