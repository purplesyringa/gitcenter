# ZeroGit documentation

## Outside .git folder

### How can I read some object?

Simply use `readObject(sha)` or `readUnknownObject(sha)`. `readObject` will give you plain data, while `readUnknownObject` will return different content for different types (TypedArray for blob, object for tree, commit and tag).

### How can I get subtree content?

You can either call `readUnknownObject` multiple times or run `readTreeItem(rootTree, "path/to/file/or/directory")`. Notice that `readTreeItem` accepts root tree, not commit, so you'll first have to call `readUnknownObject(commitId)` and then pass `commit.content.tree` property to `readTreeItem`.

### How can I get ref list?

Use `getRefList` which returns an array like `["refs/remotes/origin/master", "refs/heads/master", "refs/remotes/origin/HEAD"]`. Note that the array is not ordered at all. Then run `getRef("refs/remotes/origin/HEAD")` or `setRef("refs/remotes/origin/HEAD", "0123456789abcdefghij")`.

### How can I use branches?

Use `getBranchCommit("master")` to get commit the branch references or use `readBranchCommit("master")` to get commit object of a branch.

### How can I get HEAD ref?

Use `getHead()`.

### I can read objects, can I write them?

Yes. Currently ZeroGit only supports loose objects writing. Use `writeObject(type, plainContent)` which hashes object and returns its new SHA.

### What about auto formatting saved objects?

You can use:
1. `writeBlob(rawBlobContent)`
2. `writeTree(items)` where `items` have the same format as `readUnknownObject()` result for trees.
3. While `writeTree(items)` expects each subtree to be `{type: "tree", name: "mydir", id: "0123456789abcdefghij"}`, `writeTreeRecursive` also supports `{type: "tree", name: "mydir", content: [{type: "blob", name: "subfile", content: "myblob"}]}`. So you can build subtrees without need to call `writeTree` several times.
4. `writePlainCommit(commit)` expects `commit` to have the same format as the result of `readUnknownObject()` for commits, so it makes you set `tree` as SHA.
5. `writeCommit(commit)` works like `writePlainCommit(commit)` but also builds tree with `writeTreeRecursive(commit.tree)` and sets new SHA as commit tree.

### Can I simplify committing?

`makeTreeDelta` gives you power not to recreate all tree. It accepts `base` as result of `readUnknownObject().content` and `changes` as array of items where each item can be either `{name: "...", type: "tree", content: [...]}` or `{name: "...", remove: true}` or `{name: "...", type: "blob", content: "..."]`. The resulting value is new tree. Note that `base` argument is changed.

For example,

    [
        {
            name: "dir",
            type: "tree",
            content: [
                {
                    name: "subdir",
                    type: "tree",
                    content: [
                        {
                            name: "subfile",
                            type: "blob",
                            content: "neworchangedfile"
                        }
                    ]
                }
            ]
        },
        {
            name: "file",
            remove: true
        },
        {
            name: "olddir",
            type: "blob",
            content: "fds"
        }
    ]

...should be read as:
1. Set `dir/subdir/subfile` blob to `neworchangedfile`
2. Remove `file`
3. Replace tree `olddir` with blob `olddir`
4. Leave all not mentioned files (if there was `dir/somefile` or `readme.md` they would be added to resulting tree).

You can also use `makeTreeDeltaPath(base, changes)`. It works like `makeTreeDelta()` but accepts slash-separated `path` property instead of `name`:

    [
        {
            path: "dir/subdir/subfile",
            type: "blob",
            content: "neworchangedfile"
        },
        {
            path: "file",
            remove: true
        },
        {
            path: "olddir",
            type: "blob",
            content: "fds"
        }
    ]

### And some actions between repositories?

Yes! Run `importObject(otherGit, sha)` to read `sha` from `otherGit` and save it to `this`. And `importObjectWithDependencies(otherGit, sha)` also imports commit parents and tree, tree subitems, etc.

## Getting loose objects

For getting loose object, ZeroGit splits SHA to 2-and-18 parts, reads file `objects/01/23456789abcdefghij` and deflates it. The result is:

    blob 15\0This is line 1
    This is line 2

The part before space is type (`blob`). The part between space and `\0` is length. The part after `\0` is content. **readUnpackedObject()** returns it for you as `{type, content}` object.

## Getting packed objects

### Loading index

With packed objects, things become complex. First of all, `loadPackedIndex()` runs on Git constructing and loads pack index. You can either read [this document](https://github.com/git/git/blob/master/Documentation/technical/pack-format.txt) or continue reading.

Currently only v2 is supported. The following is the internals of `loadPackedIndex()` function:

- Magic 4-byte `\377tOc`
- 4-byte version = 2
- Fanout table:
    + 256 entries, 4 bytes each. If entry id is N (0-255), then 4 bytes mean how many objects which have first SHA byte <= N. So, first 4 bytes mean how many object SHAs start with `00`, next mean how many SHAs start with `00` or `01`, then `00`, `01` or `02`, etc. The last entry means total count.
- Sorted object names:
    + Total-count-of-objects-from-fanout-table entries, 20 bytes each. 20 bytes are SHA. SHAs are sorted, so for each SHA you can easily find its ID in the index.
- CRC32
    + Total-count-of-objects entries, 4 bytes each. They are paired with sorted-object-names, so if object is the first in object name table, then it will be the first in this table, too.
- Offset values:
    + Total-count-of-objects entries, 4 bytes each. Like in CRC32 table, entries are paired with sorted-object-names.
    + The 4 bytes are Big-Endian.
    + If bit 31 is set:
        * Lower 31 bits (0-30) are index to the next table.
    + Otherwise:
        * Lower 31 bits are pack file offsets.
- Offset entries:
    + Unknown count of entries, 8 bytes each.
    + The 8 bytes are pack file offsets.
    + You can get the byte to start reading from (relative to this table beginning) as `index-to-next-table-from-offset-values * 8`.
- 20 bytes of SHA-1 checksum
- 20 bytes of SHA-1 checksum of all of the above

So, from index file we can get only object list, pair pack file and offset to this pack file.

### Reading pack files

Index files are not very big and have much information, so we always load them. But pack files are loaded only when we access an object. `readPackedObject()` first asks index if there is such object and then `readPackedObjectAt({pack: "objects/pack/pack-....pack", packOffset: 20})` reads data from byte 20 of file `objects/pack/pack-....pack`.

Pack file structure is:

- 4 bytes: "PACK"
- 4 bytes of version (2 or 3, but Git generates only version 2)
- 4 bytes of object count
- A lot of data (which is addressed from index)
    + Each data entry looks like this:
        * Result object length:
            - First byte is `NTTTLLLL`.  `N` means the following bytes also have data. `TTT` is object type. `LLLL` is first 4 bits of length)
            - The next bytes are: `NLLLLLLL`.
            - So, if `N` is 0, length is over, if it is 1, we read next bytes and treat them as length.
        * If type is 1-4: (1 - commit, 2 - tree, 3 - blob, 4 - tag)
            - Deflate all other data. Remember, we only know *result* length, so we have to deflate the rest of file.
            - The deflated data is object content.
        * If type is 5 or 6:
            - If type is 5:
                + That's offset delta.
                + First of all, read base offset. The following code can do this:
                    ```
                    byte = *data++;
                    number = byte & 0x7f;
                    while (byte & 0x80) {
                        byte = *data++;
                        number = ((number + 1) << 7) | (byte & 0x7f);
                    }
                    ```
                + Then you read base object from position `current_object_position - number` (maybe recursively, because base object can be delta, too; base objects can be both outside and inside pack) and save it.
            - If type is 6:
                + That's reference delta.
                + Use the next 20 bytes as SHA of base object. Read it (recursively) and save.
            - All the rest is delta data (deflated).
                + First we read base length - Little-Endian-128-base-number:
                    * All the bytes are `NLLLLLLL`. `N` means the following bytes also have data. `LLLLLLL` means 7 bits of data.
                + Then read result length - Little-Endian-128-base-number, too.
                + Then we read delta hunks. Each delta hunk is:
                    * If the first byte is zero, skip it.
                    * If the first byte has bit 7 set:
                        - It's a copy hunk.
                        - You can use the following code to decode this byte:
                            ```
                            byte *data = delta_hunk_start
                            opcode = *data++
                            off_t copy_offset= 0;
                            size_t copy_length = 0;

                            for (shift=i=0; i<4; i++) {
                                if (opcode & 0x01) {
                                    copy_offset |= (*data++)<<shift;
                                }
                                opcode >>= 1;
                                shift += 8;
                            }

                            for (shift=i=0; i<3; i++) {
                                if (opcode & 0x01) {
                                    copy_length |= (*data++)<<shift;
                                }
                                opcode >>= 1;
                                shift += 8;
                            }

                            if (!copy_length) {
                                copy_length = 1<<16;
                            }
                            ```
                        - Copy offset and copy length are relative to base object.
                    * If the first byte has byte 7 not set:
                        - It's an insert hunk.
                        - Bits 0-6 mean: treat them as base-128 number N and copy the following N bytes to the result object content.
- 20-byte SHA-1 checksum of the file

### Problems

1. Use ArrayBuffer or TypedArray for data, not `String.fromCharCode/String#charCodeAt`. Strings don't handle bytes, they handle codepoints.
