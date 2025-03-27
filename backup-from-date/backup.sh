#!/bin/bash -e

parent_dir=$1
backup_dir=$2
since_date=$3

mkdir -p $backup_dir
cd $parent_dir
find . -type f -newermt $since_date -exec echo '"{}"' \; > /tmp/files.txt

while IFS= read -r line; do
    path=$(echo $line | sed s#//*#/#g | tr -d '"') # Remove extra slashes
    if ! echo $path | grep -q "DS_Store" ; then
        echo "Copying $path to $backup_dir..."
        rsync -R "$path" $backup_dir
    fi
done < /tmp/files.txt
rm /tmp/files.txt
