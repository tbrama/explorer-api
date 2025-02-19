CREATE TABLE `folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentDir` int,
	`folders_name` varchar(120),
	`isFile` int,
	CONSTRAINT `folders_id` PRIMARY KEY(`id`)
);
